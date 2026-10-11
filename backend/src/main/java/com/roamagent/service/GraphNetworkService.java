package com.roamagent.service;

import com.roamagent.entity.BusService;
import com.roamagent.entity.FareRecord;
import com.roamagent.entity.ServiceStop;
import com.roamagent.entity.Stop;
import com.roamagent.repository.BusServiceRepository;
import com.roamagent.repository.FareRecordRepository;
import com.roamagent.repository.ServiceStopRepository;
import com.roamagent.repository.StopRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GraphNetworkService {

    private final StopRepository stopRepository;
    private final ServiceStopRepository serviceStopRepository;
    private final BusServiceRepository busServiceRepository;
    private final FareRecordRepository fareRecordRepository;

    @Data
    @Builder
    @AllArgsConstructor
    public static class RouteLeg {
        private BusService busService;
        private Stop fromStop;
        private Stop toStop;
        private LocalDateTime departureTime;
        private LocalDateTime arrivalTime;
        private BigDecimal fare;
        private String seatType;
    }

    @Data
    @Builder
    @AllArgsConstructor
    public static class RouteCandidate {
        private List<RouteLeg> legs;
        private BigDecimal totalFare;
        private int totalDurationMinutes;
        private int totalTransfers;
    }

    public List<RouteCandidate> searchRoutes(String originCity, String destinationCity, LocalDate travelDate) {
        LocalDate effectiveDate = travelDate != null ? travelDate : LocalDate.now();
        List<Stop> originStops = stopRepository.findByCityIgnoreCase(originCity);
        List<Stop> destStops = stopRepository.findByCityIgnoreCase(destinationCity);

        List<RouteCandidate> candidates = new ArrayList<>();
        if (originStops.isEmpty() || destStops.isEmpty()) {
            return candidates;
        }

        List<BusService> allServices = busServiceRepository.findAll();

        for (Stop origin : originStops) {
            for (Stop dest : destStops) {
                // 1. Search Direct Routes
                for (BusService service : allServices) {
                    List<ServiceStop> serviceStops = serviceStopRepository.findByBusServiceIdOrdered(service.getId());
                    Optional<ServiceStop> originSSOpt = serviceStops.stream().filter(ss -> ss.getStop().getId().equals(origin.getId())).findFirst();
                    Optional<ServiceStop> destSSOpt = serviceStops.stream().filter(ss -> ss.getStop().getId().equals(dest.getId())).findFirst();

                    if (originSSOpt.isPresent() && destSSOpt.isPresent()) {
                        ServiceStop originSS = originSSOpt.get();
                        ServiceStop destSS = destSSOpt.get();

                        if (originSS.getStopSequence() < destSS.getStopSequence()) {
                            LocalDateTime depTime = LocalDateTime.of(effectiveDate, originSS.getScheduledDepartureTime()).plusDays(originSS.getDayOffset());
                            LocalDateTime arrTime = LocalDateTime.of(effectiveDate, destSS.getScheduledArrivalTime()).plusDays(destSS.getDayOffset());

                            BigDecimal fare = fareRecordRepository.findByBusServiceIdAndFromStopIdAndToStopId(service.getId(), origin.getId(), dest.getId())
                                    .map(FareRecord::getBaseFare)
                                    .orElse(BigDecimal.valueOf(700.0));

                            RouteLeg leg = RouteLeg.builder()
                                    .busService(service)
                                    .fromStop(origin)
                                    .toStop(dest)
                                    .departureTime(depTime)
                                    .arrivalTime(arrTime)
                                    .fare(fare)
                                    .seatType(service.getServiceType())
                                    .build();

                            int durationMinutes = (int) java.time.Duration.between(depTime, arrTime).toMinutes();

                            candidates.add(RouteCandidate.builder()
                                    .legs(List.of(leg))
                                    .totalFare(fare)
                                    .totalDurationMinutes(durationMinutes)
                                    .totalTransfers(0)
                                    .build());
                        }
                    }
                }

                // 2. Search 1-Transfer Multi-leg Routes (e.g. via Vijayawada)
                List<Stop> transferHubs = stopRepository.findByCityIgnoreCase("Vijayawada");
                for (Stop hub : transferHubs) {
                    if (origin.getId().equals(hub.getId()) || dest.getId().equals(hub.getId())) continue;

                    for (BusService s1 : allServices) {
                        List<ServiceStop> s1Stops = serviceStopRepository.findByBusServiceIdOrdered(s1.getId());
                        Optional<ServiceStop> originSSOpt = s1Stops.stream().filter(ss -> ss.getStop().getId().equals(origin.getId())).findFirst();
                        Optional<ServiceStop> hubSS1Opt = s1Stops.stream().filter(ss -> ss.getStop().getId().equals(hub.getId())).findFirst();

                        if (originSSOpt.isPresent() && hubSS1Opt.isPresent() && originSSOpt.get().getStopSequence() < hubSS1Opt.get().getStopSequence()) {
                            ServiceStop originSS = originSSOpt.get();
                            ServiceStop hubSS1 = hubSS1Opt.get();

                            LocalDateTime leg1Dep = LocalDateTime.of(effectiveDate, originSS.getScheduledDepartureTime()).plusDays(originSS.getDayOffset());
                            LocalDateTime leg1Arr = LocalDateTime.of(effectiveDate, hubSS1.getScheduledArrivalTime()).plusDays(hubSS1.getDayOffset());

                            for (BusService s2 : allServices) {
                                if (s1.getId().equals(s2.getId())) continue;

                                List<ServiceStop> s2Stops = serviceStopRepository.findByBusServiceIdOrdered(s2.getId());
                                Optional<ServiceStop> hubSS2Opt = s2Stops.stream().filter(ss -> ss.getStop().getId().equals(hub.getId())).findFirst();
                                Optional<ServiceStop> destSSOpt = s2Stops.stream().filter(ss -> ss.getStop().getId().equals(dest.getId())).findFirst();

                                if (hubSS2Opt.isPresent() && destSSOpt.isPresent() && hubSS2Opt.get().getStopSequence() < destSSOpt.get().getStopSequence()) {
                                    ServiceStop hubSS2 = hubSS2Opt.get();
                                    ServiceStop destSS = destSSOpt.get();

                                    LocalDateTime leg2Dep = LocalDateTime.of(effectiveDate, hubSS2.getScheduledDepartureTime()).plusDays(hubSS2.getDayOffset());
                                    LocalDateTime leg2Arr = LocalDateTime.of(effectiveDate, destSS.getScheduledArrivalTime()).plusDays(destSS.getDayOffset());

                                    BigDecimal fare1 = fareRecordRepository.findByBusServiceIdAndFromStopIdAndToStopId(s1.getId(), origin.getId(), hub.getId())
                                            .map(FareRecord::getBaseFare).orElse(BigDecimal.valueOf(700.0));
                                    BigDecimal fare2 = fareRecordRepository.findByBusServiceIdAndFromStopIdAndToStopId(s2.getId(), hub.getId(), dest.getId())
                                            .map(FareRecord::getBaseFare).orElse(BigDecimal.valueOf(650.0));

                                    RouteLeg leg1 = RouteLeg.builder()
                                            .busService(s1).fromStop(origin).toStop(hub)
                                            .departureTime(leg1Dep).arrivalTime(leg1Arr).fare(fare1)
                                            .seatType(s1.getServiceType()).build();

                                    RouteLeg leg2 = RouteLeg.builder()
                                            .busService(s2).fromStop(hub).toStop(dest)
                                            .departureTime(leg2Dep).arrivalTime(leg2Arr).fare(fare2)
                                            .seatType(s2.getServiceType()).build();

                                    int totalDuration = (int) java.time.Duration.between(leg1Dep, leg2Arr).toMinutes();

                                    candidates.add(RouteCandidate.builder()
                                            .legs(List.of(leg1, leg2))
                                            .totalFare(fare1.add(fare2))
                                            .totalDurationMinutes(totalDuration)
                                            .totalTransfers(1)
                                            .build());
                                }
                            }
                        }
                    }
                }
            }
        }

        return candidates;
    }
}

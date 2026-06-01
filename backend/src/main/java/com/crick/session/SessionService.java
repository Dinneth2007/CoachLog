package com.crick.session;

import com.crick.auth.User;
import com.crick.player.Player;
import com.crick.player.PlayerRepository;
import jakarta.persistence.EntityNotFoundException;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class SessionService {

    private final SessionRepository sessionRepository;
    private final PlayerObservationRepository observationRepository;
    private final PlayerRepository playerRepository;

    public SessionResponse create(User coach, CreateSessionRequest req) {
        Session s = new Session();
        s.setDate(req.date());
        s.setTitle(req.title().trim());
        s.setNotes(req.notes() != null ? req.notes().trim() : null);
        s.setCoach(coach);
        return SessionResponse.from(sessionRepository.save(s));
    }

    @Transactional(readOnly = true)
    public Page<SessionSummaryResponse> list(Long coachId, Pageable pageable) {
        Pageable safe = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        return sessionRepository.findSummariesByCoachId(coachId, safe);
    }

    @Transactional(readOnly = true)
    public SessionDetailResponse getDetail(Long coachId, Long sessionId) {
        Session session = sessionRepository.findDetailByIdAndCoachId(sessionId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));
        List<PlayerObservation> observations = observationRepository.findBySessionIdWithScores(sessionId);
        return SessionDetailResponse.from(session, observations);
    }

    public AttendanceResponse setAttendance(Long coachId, Long sessionId, AttendanceRequest req) {
        Session session = sessionRepository.findByIdAndCoachId(sessionId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));

        List<Long> distinctIds = req.playerIds().stream().distinct().toList();
        List<Player> found = distinctIds.isEmpty()
                ? List.of()
                : playerRepository.findAllByIdInAndCoachId(distinctIds, coachId);
        if (found.size() != distinctIds.size()) {
            throw new IllegalArgumentException("One or more players do not belong to this coach");
        }

        session.getPlayers().clear();
        session.getPlayers().addAll(found);
        sessionRepository.save(session);

        List<AttendanceResponse.PlayerSummary> summaries = found.stream()
                .sorted(Comparator.comparing(Player::getName))
                .map(p -> new AttendanceResponse.PlayerSummary(p.getId(), p.getName(), p.getAgeGroup()))
                .toList();
        return new AttendanceResponse(summaries);
    }

    public SubmitObservationsResponse submitObservations(Long coachId, Long sessionId, SubmitObservationsRequest req) {
        Session session = sessionRepository.findDetailByIdAndCoachId(sessionId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));

        Set<Long> attendanceIds = session.getPlayers().stream()
                .map(Player::getId)
                .collect(Collectors.toSet());

        Set<Long> seenPlayerIds = new HashSet<>();
        for (SubmitObservationsRequest.ObservationItem item : req.observations()) {
            if (!attendanceIds.contains(item.playerId())) {
                throw new IllegalArgumentException(
                        "Player " + item.playerId() + " is not in this session's attendance");
            }
            if (!seenPlayerIds.add(item.playerId())) {
                throw new IllegalArgumentException("Duplicate observation for player " + item.playerId());
            }
            Set<String> seenScoreKeys = new HashSet<>();
            for (SubmitObservationsRequest.ScoreItem s : item.scores()) {
                if (s.dimension().category() != s.category()) {
                    throw new IllegalArgumentException(
                            "Dimension " + s.dimension().json() + " is not valid for category " + s.category());
                }
                String key = s.category().name() + "/" + s.dimension().name();
                if (!seenScoreKeys.add(key)) {
                    throw new IllegalArgumentException(
                            "Duplicate score for player " + item.playerId() + " on "
                                    + s.category() + "/" + s.dimension().json());
                }
            }
        }

        observationRepository.deleteAllBySessionId(sessionId);
        observationRepository.flush();

        Map<Long, Player> playersById = session.getPlayers().stream()
                .collect(Collectors.toMap(Player::getId, Function.identity()));

        for (SubmitObservationsRequest.ObservationItem item : req.observations()) {
            PlayerObservation obs = new PlayerObservation();
            obs.setSession(session);
            obs.setPlayer(playersById.get(item.playerId()));
            obs.setOverallNotes(item.overallNotes() != null ? item.overallNotes().trim() : null);
            for (SubmitObservationsRequest.ScoreItem s : item.scores()) {
                TechniqueScore ts = new TechniqueScore();
                ts.setObservation(obs);
                ts.setCategory(s.category());
                ts.setDimension(s.dimension());
                ts.setScore(s.score());
                ts.setNotes(s.notes() != null ? s.notes().trim() : null);
                obs.getScores().add(ts);
            }
            observationRepository.save(obs);
        }

        return new SubmitObservationsResponse(req.observations().size());
    }

    public void delete(Long coachId, Long sessionId) {
        Session session = sessionRepository.findByIdAndCoachId(sessionId, coachId)
                .orElseThrow(() -> new EntityNotFoundException("Session not found"));
        sessionRepository.delete(session);
    }
}

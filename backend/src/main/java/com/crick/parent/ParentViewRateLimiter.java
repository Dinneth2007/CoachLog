package com.crick.parent;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class ParentViewRateLimiter {

    private static final int MAX_REQUESTS = 30;
    private static final long WINDOW_MS = 3_600_000L;

    private final Map<String, Deque<Long>> requests = new ConcurrentHashMap<>();

    public boolean allow(String token) {
        long now = System.currentTimeMillis();
        Deque<Long> timestamps = requests.computeIfAbsent(token, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > WINDOW_MS) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= MAX_REQUESTS) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }
}

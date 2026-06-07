package com.crick.dashboard;

import com.crick.auth.CurrentUser;
import com.crick.auth.User;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public DashboardResponse get(@CurrentUser User coach) {
        return dashboardService.getDashboard(coach);
    }
}

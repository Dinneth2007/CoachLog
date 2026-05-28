package com.crick;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class CrickApplication {

    public static void main(String[] args) {
        SpringApplication.run(CrickApplication.class, args);
    }
}

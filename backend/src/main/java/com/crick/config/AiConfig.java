package com.crick.config;

import java.time.Duration;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
@Getter
public class AiConfig {

    @Value("${ai.embedding.api-key}")
    private String embeddingApiKey;

    @Value("${ai.embedding.api-url}")
    private String embeddingApiUrl;

    @Value("${ai.chat.api-url}")
    private String chatApiUrl;

    @Value("${ai.chat.api-key}")
    private String chatApiKey;

    @Value("${ai.chat.model}")
    private String chatModel;

    @Bean
    public RestTemplate aiRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(30));
        factory.setReadTimeout(Duration.ofSeconds(30));
        return new RestTemplate(factory);
    }
}

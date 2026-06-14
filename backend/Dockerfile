# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Stage 1 — Build: compile the Spring Boot app into an executable jar.
# We use a full JDK image here because we need the Java compiler + Maven.
# ----------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Copy only the files needed to resolve dependencies first.
# Docker caches each layer, so as long as pom.xml doesn't change,
# the (slow) dependency download is reused on future builds.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

# Now copy the source and build the jar. Tests are skipped here because
# they need a live MySQL; CI/local is where we run them.
COPY src/ src/
RUN ./mvnw -B -q clean package -DskipTests

# ----------------------------------------------------------------------------
# Stage 2 — Runtime: a small JRE-only image that just runs the jar.
# The compiler, Maven, and source code are left behind in stage 1, so the
# final image is much smaller and has a smaller attack surface.
# ----------------------------------------------------------------------------
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Best practice: never run a container as root. Create an unprivileged user.
RUN useradd -r -u 1001 appuser

# Copy just the built jar from the build stage.
COPY --from=build /app/target/*.jar app.jar

USER appuser

# Render injects the port via $PORT; Spring reads it (server.port=${PORT:8080}).
# EXPOSE is documentation only.
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

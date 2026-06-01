package com.crick.session;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum TechniqueDimension {
    STANCE(Category.BATTING),
    FOOTWORK(Category.BATTING),
    BAT_PATH(Category.BATTING),
    TIMING(Category.BATTING),
    SHOT_SELECTION(Category.BATTING),

    ACTION(Category.BOWLING),
    LINE(Category.BOWLING),
    LENGTH(Category.BOWLING),
    VARIATIONS(Category.BOWLING),
    CONTROL(Category.BOWLING),

    CATCHING(Category.FIELDING),
    THROWING(Category.FIELDING),
    POSITIONING(Category.FIELDING),
    AGILITY(Category.FIELDING),

    DECISION_MAKING(Category.MATCH_AWARENESS),
    COMMUNICATION(Category.MATCH_AWARENESS),
    PRESSURE_RESPONSE(Category.MATCH_AWARENESS);

    private final Category category;

    TechniqueDimension(Category category) {
        this.category = category;
    }

    public Category category() {
        return category;
    }

    @JsonValue
    public String json() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static TechniqueDimension fromJson(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}

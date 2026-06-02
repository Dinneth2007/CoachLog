package com.crick.drill;

import com.crick.session.Category;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DrillRepository extends JpaRepository<Drill, Long> {

    List<Drill> findAllByEmbeddingIsNotNull();

    @Query("""
            SELECT d FROM Drill d
            WHERE (:skillArea IS NULL OR d.skillArea = :skillArea)
              AND (:difficulty IS NULL OR d.difficulty = :difficulty)
              AND (:ageCap IS NULL OR d.ageMin IS NULL OR d.ageMin <= :ageCap)
              AND (:search IS NULL OR
                   LOWER(d.name) LIKE LOWER(CONCAT('%', :search, '%')) OR
                   LOWER(d.description) LIKE LOWER(CONCAT('%', :search, '%')) OR
                   LOWER(CAST(d.targetIssue AS string)) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY d.skillArea, d.id
            """)
    Page<Drill> search(@Param("skillArea") Category skillArea,
                       @Param("difficulty") Difficulty difficulty,
                       @Param("ageCap") Integer ageCap,
                       @Param("search") String search,
                       Pageable pageable);
}

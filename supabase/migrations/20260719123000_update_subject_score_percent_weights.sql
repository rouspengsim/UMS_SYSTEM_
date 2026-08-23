ALTER TABLE public.subject_scores
  DROP CONSTRAINT IF EXISTS subject_scores_midterm_score_check,
  DROP CONSTRAINT IF EXISTS subject_scores_final_score_check,
  ADD CONSTRAINT subject_scores_midterm_score_check
    CHECK (midterm_score IS NULL OR (midterm_score >= 0 AND midterm_score <= 25)),
  ADD CONSTRAINT subject_scores_final_score_check
    CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 45));

ALTER TABLE public.subject_scores
  ADD COLUMN IF NOT EXISTS attendance_score NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS assignment_score NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS midterm_score NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS final_score NUMERIC(6,2),
  ADD CONSTRAINT subject_scores_attendance_score_check
    CHECK (attendance_score IS NULL OR (attendance_score >= 0 AND attendance_score <= 10)),
  ADD CONSTRAINT subject_scores_assignment_score_check
    CHECK (assignment_score IS NULL OR (assignment_score >= 0 AND assignment_score <= 20)),
  ADD CONSTRAINT subject_scores_midterm_score_check
    CHECK (midterm_score IS NULL OR (midterm_score >= 0 AND midterm_score <= 25)),
  ADD CONSTRAINT subject_scores_final_score_check
    CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 45)),
  ADD CONSTRAINT subject_scores_total_score_check
    CHECK (score IS NULL OR (score >= 0 AND score <= 100));

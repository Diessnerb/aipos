-- Create table for tracking course check-back quality feedback
CREATE TABLE IF NOT EXISTS public.course_checkback_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  course TEXT NOT NULL CHECK (course IN ('starters', 'mains', 'desserts')),
  quality_rating TEXT NOT NULL CHECK (quality_rating IN ('good', 'bad')),
  feedback_notes TEXT,
  staff_user_id UUID,
  checkback_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.course_checkback_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy for company isolation
CREATE POLICY "course_checkback_feedback_company_isolation" 
ON public.course_checkback_feedback
FOR ALL 
USING (company_id IN (SELECT allowed_company_ids_for_current_user()));

-- Index for performance
CREATE INDEX idx_course_checkback_company_reservation 
ON public.course_checkback_feedback(company_id, reservation_id, checkback_timestamp);

CREATE INDEX idx_course_checkback_quality_analysis 
ON public.course_checkback_feedback(company_id, course, quality_rating, checkback_timestamp);

-- Comments
COMMENT ON TABLE public.course_checkback_feedback IS 'Tracks staff check-back quality ratings and feedback for course service - helps identify recurring food quality issues';
COMMENT ON COLUMN public.course_checkback_feedback.quality_rating IS 'Staff assessment: good (guests happy) or bad (issue reported)';
COMMENT ON COLUMN public.course_checkback_feedback.feedback_notes IS 'Staff notes when quality_rating is bad - what went wrong?';
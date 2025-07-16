-- 添加复合索引
CREATE INDEX IF NOT EXISTS "candidate_stage_status_idx" ON "Candidate" ("atsStage", "pipelineStatus", "status");

-- 添加按更新时间排序的索引
CREATE INDEX IF NOT EXISTS "candidate_stage_updated_idx" ON "Candidate" ("stageUpdatedAt" DESC);

-- 添加外键索引
CREATE INDEX IF NOT EXISTS "candidate_github_user_idx" ON "Candidate" ("githubUserId");
CREATE INDEX IF NOT EXISTS "candidate_job_description_idx" ON "Candidate" ("jobDescriptionId"); 
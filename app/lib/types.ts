/**
 * Core entity types for Shadow Bee
 */

/**
 * Source metadata for tracking where users/repos were discovered
 */
export interface SourceMeta {
  language?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  repository?: string;
  username?: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Job Description entity representing an employer's job posting
 */
export interface JobDescription {
  id?: string;
  title?: string;
  rawDescription: string;
  languages: string[];
  frameworks: string[];
  otherKeywords: string[];
  seniority?: string;
  yearsOfExperience?: number | null;
  parsingMethod: 'traditional' | 'llm';
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
}

/**
 * Job Description analysis result from the parser
 */
export interface ParsedJobDescription {
  title?: string;
  rawDescription: string;
  languages: string[];
  frameworks: string[];
  otherKeywords: string[];
  seniority?: string;
  yearsOfExperience?: number | null;
}

/**
 * Configuration for the JD analyzer
 */
export interface JDAnalyzerConfig {
  parsingMethod: 'traditional' | 'llm';
  minConfidence?: number;
  llmApiKey?: string;
  model?: string;
}



/**
 * Candidate entity that can link multiple social profiles
 */
export interface Candidate {
  id?: string;
  matchScore?: number | null; // Overall match score for ranking (simple number)
  status?: 'new' | 'contacted' | 'responded' | 'not_interested' | 'in_progress';
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}





/**
 * Match score details for ranking candidates
 */
export interface MatchScore {
  overall: number; // 0-100
  skillMatch: number; // How well their skills match the JD
  projectRelevance: number; // How relevant their projects are
  activityLevel: number; // How active they are
  contributionQuality: number; // Quality of their contributions
}

/**
 * Extended candidate type with related data for display/ranking
 */
export interface CandidateWithDetails extends Candidate {
  matchScoreDetails?: MatchScore; // Detailed scoring breakdown
}

export interface ContributionHistory {
  year: number;
  totalContributions: number;
  commitPercentage?: number;
  prPercentage?: number;
  reviewPercentage?: number;
  issuePercentage?: number;
}

/**
 * Ranked candidate with scoring information
 */
export interface RankedCandidate {
  id: string;
  username: string;
  name?: string;
  score: number;
  scoreBreakdown?: {
    [key: string]: number;
  };
  notes?: string | null;
  candidateId?: string; // Candidate ID from the database
  options?: {
    concurrency?: number;
  };
}

export interface CodingQueryIntentCase {
  query: string;
  expectedQueryType:
    | "command_selection"
    | "change_location"
    | "reviewer_correction"
    | "dangerous_file"
    | "architecture_decision"
    | "failed_last_time"
    | "repo_change";
}

export const CODING_QUERY_INTENT_CASES: CodingQueryIntentCase[] = [
  { query: "What command should I run before publishing the SDK?", expectedQueryType: "command_selection" },
  { query: "Which command runs the API unit tests?", expectedQueryType: "command_selection" },
  { query: "Run tests for the changed package with npm", expectedQueryType: "command_selection" },
  { query: "Should this repo use pnpm or npm for tests?", expectedQueryType: "command_selection" },
  { query: "Use pytest for the FastAPI validation change?", expectedQueryType: "command_selection" },
  { query: "Which go test command covers this service?", expectedQueryType: "command_selection" },
  { query: "What test command is required before release?", expectedQueryType: "command_selection" },
  { query: "Which command checks the migration fixtures?", expectedQueryType: "command_selection" },
  { query: "Where should this validation change go?", expectedQueryType: "change_location" },
  { query: "Which file owns the invoice validation?", expectedQueryType: "change_location" },
  { query: "Which folder contains schema validation?", expectedQueryType: "change_location" },
  { query: "What file should receive this auth change?", expectedQueryType: "change_location" },
  { query: "Add validation for account status in the right module", expectedQueryType: "change_location" },
  { query: "Place this migration handler in the correct directory", expectedQueryType: "change_location" },
  { query: "Where does the route convention put request parsing?", expectedQueryType: "change_location" },
  { query: "What did the reviewer correct about tests?", expectedQueryType: "reviewer_correction" },
  { query: "Reviewer requested changes for the package manager", expectedQueryType: "reviewer_correction" },
  { query: "Show the correction from the last review", expectedQueryType: "reviewer_correction" },
  { query: "The user said that was wrong last time", expectedQueryType: "reviewer_correction" },
  { query: "Which feedback fixed the generated file edit?", expectedQueryType: "reviewer_correction" },
  { query: "Was wurde im Review korrigiert?", expectedQueryType: "reviewer_correction" },
  { query: "Use the previous correction for this patch", expectedQueryType: "reviewer_correction" },
  { query: "Is this generated file safe to edit?", expectedQueryType: "dangerous_file" },
  { query: "Do not edit dist files in this repo?", expectedQueryType: "dangerous_file" },
  { query: "Forbidden file rule for this change", expectedQueryType: "dangerous_file" },
  { query: "Should I edit the lockfile manually?", expectedQueryType: "dangerous_file" },
  { query: "Dangerous file check before touching build output", expectedQueryType: "dangerous_file" },
  { query: "Is this generated file off limits here?", expectedQueryType: "dangerous_file" },
  { query: "Show the forbidden file rule for API clients", expectedQueryType: "dangerous_file" },
  { query: "Architecture decision for validation placement", expectedQueryType: "architecture_decision" },
  { query: "ADR for authentication middleware", expectedQueryType: "architecture_decision" },
  { query: "Module boundary for billing service changes", expectedQueryType: "architecture_decision" },
  { query: "Directory convention for generated clients", expectedQueryType: "architecture_decision" },
  { query: "Existing pattern for dependency injection", expectedQueryType: "architecture_decision" },
  { query: "Validation architecture for invoice rules", expectedQueryType: "architecture_decision" },
  { query: "Which dependency rule applies to logging?", expectedQueryType: "architecture_decision" },
  { query: "What failed last time when running tests?", expectedQueryType: "failed_last_time" },
  { query: "Previous tool failed with which exit code?", expectedQueryType: "failed_last_time" },
  { query: "CI failed on the migration branch", expectedQueryType: "failed_last_time" },
  { query: "Last failure reason for the dashboard build", expectedQueryType: "failed_last_time" },
  { query: "What failed in the prior tool outcome?", expectedQueryType: "failed_last_time" },
  { query: "Test failed after the schema change", expectedQueryType: "failed_last_time" },
  { query: "Show the failed last time evidence", expectedQueryType: "failed_last_time" },
  { query: "What changed in this repo after the test migration?", expectedQueryType: "repo_change" },
  { query: "Repository changed its package manager", expectedQueryType: "repo_change" },
  { query: "The auth API was deprecated in this branch", expectedQueryType: "repo_change" },
  { query: "New convention for generated files", expectedQueryType: "repo_change" },
  { query: "Branch rule for release hardening", expectedQueryType: "repo_change" },
  { query: "Package changed from Jest to Vitest", expectedQueryType: "repo_change" },
  { query: "CI config changed for workspace tests", expectedQueryType: "repo_change" }
];

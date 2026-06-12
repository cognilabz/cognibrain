# Fixed Harness Trigger Points

Cognibrain will define a fixed minimum set of Harness Trigger Points for every supported harness: `session_start`, `before_action`, `after_tool_result`, `after_user_correction`, `before_final_answer`, `after_task_outcome`, and `session_end`. Each adapter may map those events to its host agent differently, but Harness Conformance must prove the semantic trigger is present and handled.

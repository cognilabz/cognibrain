"""Minimal LangGraph-style cognibrain hook.

The example avoids importing LangGraph so it can run in CI without optional
framework dependencies. In a real graph, call `before_model` before the LLM node
and `after_feedback` after a human/tool feedback node.
"""

from cognibrain_client import CognibrainClient


client = CognibrainClient(actor_id="langgraph-agent")


def before_model(state):
    query = state.get("query", "")
    user_id = state.get("userId", "default")
    pack = client.evidence_pack({"userId": user_id, "query": query, "tokenBudget": 900})
    return {**state, "cognibrain_context": pack.get("context", ""), "cognibrain_pack_id": pack.get("id")}


def after_feedback(state):
    feedback = state.get("feedback")
    if not feedback:
        return state
    client.action(
        {
            "userId": state.get("userId", "default"),
            "content": str(feedback),
            "tool": "langgraph",
            "metadata": {"packId": state.get("cognibrain_pack_id")},
        }
    )
    return state

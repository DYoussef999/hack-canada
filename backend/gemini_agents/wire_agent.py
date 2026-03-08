"""wire_agent.py — Gemini Wire Matcher for auto-wiring expenses to revenue streams."""

import json
import logging
import re

import google.generativeai as genai
from google.genai.types import GenerateContentResponse

log = logging.getLogger(__name__)

genai.configure(api_key="AIzaSyBW4MV27TBLUSdkJHM5_6pVDxe3sDvKCHU")
model = genai.GenerativeModel("gemini-2.0-flash")


async def auto_wire(
    revenue_nodes: list[dict], expense_nodes: list[dict]
) -> dict[str, list[dict]]:
    """
    Match unconnected expenses to revenue streams using Gemini.

    Returns:
    - mappings: list of {"source": expense_id, "target": revenue_id}
    """
    if not expense_nodes or not revenue_nodes:
        return {"mappings": []}

    prompt = f"""You are a financial AI expert matching business expenses to revenue streams.

REVENUE STREAMS (revenue sources / income):
{json.dumps(revenue_nodes, indent=2)}

UNCONNECTED EXPENSES (costs to be matched):
{json.dumps(expense_nodes, indent=2)}

YOUR TASK:
Match EACH expense to EXACTLY ONE best-fit revenue stream.
- Consider the expense category and label
- More specific matches are better
- All expenses must be matched

RESPOND ONLY with valid JSON (no explanation, no markdown):
{{
  "mappings": [
    {{"source": "<<expense_id>>", "target": "<<revenue_id>>"}},
    ...
  ]
}}"""

    try:
        response: GenerateContentResponse = await model.generate_content_async(prompt)
        content = response.text.strip()

        # Extract JSON from markdown code blocks if present
        json_match = re.search(r"```(?:json)?\s*(.*?)\s*```", content, re.DOTALL)
        if json_match:
            content = json_match.group(1)

        # Parse the JSON
        result = json.loads(content)
        mappings = result.get("mappings", [])

        log.info(
            f"wire_agent: ✓ matched {len(expense_nodes)} expenses to {len(set(m['target'] for m in mappings))} revenue streams"
        )
        return {"mappings": mappings}

    except json.JSONDecodeError as e:
        log.error(f"wire_agent: JSON parse error: {e}")
        log.error(f"wire_agent: raw response: {content[:500]}")
        return {"mappings": []}
    except Exception as e:
        log.exception(f"wire_agent: error during matching")
        return {"mappings": []}

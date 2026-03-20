import anthropic
import json
from datetime import datetime
import logging

from backend.config import settings

logger = logging.getLogger(__name__)

class DataQualityExpert:
    def __init__(self, api_key: str, model_name: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model_name = model_name

    def analyze(self, validation_results):
        try:
            prompt = self._build_prompt(validation_results)

            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=4000,
                temperature=1,
                system="You are a senior Data Quality Expert. Analyze the validation results and give clear, useful recommendations.",
                messages=[
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": prompt}]
                    }
                ]
            )

            raw_summary = response.content[0].text
            similarity_scores = self.score_similarity(
                computed_scores={
                    "validation_summary": validation_results.get("summary", {}) if isinstance(validation_results, dict) else {},
                },
                context={"source": "validation_results"},
            )
            final_summary = self._ensure_summary_score_paragraph(
                raw_summary,
                similarity_scores.get("scores", {}) if isinstance(similarity_scores, dict) else {},
            )

            return {
                "timestamp": datetime.now().isoformat(),
                "result_summary": final_summary,
                "status": "success"
            }

        except Exception as e:
            logger.error(f"AI analysis failed: {str(e)}")
            return {
                "timestamp": datetime.now().isoformat(),
                "result_summary": f"AI analysis failed: {str(e)}",
                "status": "error",
                "error": str(e)
            }

    def score_similarity(self, computed_scores, context=None):
        """Generate AI-estimated similarity scores aligned with computed score categories."""
        try:
            prompt = self._build_similarity_score_prompt(computed_scores, context)

            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=1200,
                temperature=0.2,
                system=(
                    "You are a senior data quality statistician. "
                    "Return only valid JSON with numeric scores from 0 to 100."
                ),
                messages=[
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": prompt}]
                    }
                ]
            )

            raw_text = response.content[0].text if response.content else ""
            parsed = self._extract_json_object(raw_text)

            score_fields = [
                "overallScore",
                "structuralScore",
                "univariateScore",
                "bivariateScore",
                "anomalyScore",
                "multiVariableScore",
            ]

            ai_scores = {}
            for field in score_fields:
                value = parsed.get(field)
                if isinstance(value, (int, float)):
                    ai_scores[field] = max(0.0, min(100.0, float(value)))

            return {
                "timestamp": datetime.now().isoformat(),
                "status": "success",
                "scores": ai_scores,
                "confidence": parsed.get("confidence"),
                "rationale": parsed.get("rationale", ""),
                "raw_response": raw_text,
            }
        except Exception as e:
            logger.error(f"AI similarity scoring failed: {str(e)}")
            return {
                "timestamp": datetime.now().isoformat(),
                "status": "error",
                "scores": {},
                "error": str(e),
            }

    def _build_prompt(self, validation_results):
        try:
            prompt = "You are a senior Data Quality Expert.\n\n"
            prompt += "The following are validation results comparing real and synthetic data:\n\n"
            prompt += json.dumps(validation_results, indent=2)
            prompt += "\n\nPlease provide a clear analysis that includes:\n"
            prompt += "SECTION_TITLE: Summary (250 words minimum)\n"
            prompt += "In the Summary section, include one explicit paragraph titled 'AI Generated Score:' with these six scores (0-100): Overall Similarity Score, Multi-variable Score, Anomaly Burden Score, Bivariate Score, Structural Validity Score, and Univariate Similarity Score.\n"
            prompt += "SECTION_TITLE: Key Findings (250 words minimum)\n"
            prompt += "SECTION_TITLE: Statistical Quality (250 words minimum)\n"
            prompt += "SECTION_TITLE: Practical Usefulness (250 words minimum)\n"
            prompt += "SECTION_TITLE: Critical Issues (if any)\n"
            prompt += "SECTION_TITLE: Variable Range and Type Checks: identify synthetic variables with unreasonable value ranges and flag any data type mismatches between real and synthetic data, highlighting the variables.\n"
            prompt += "SECTION_TITLE: Real Data Quality by Variable: assess each real-data variable for plausible ranges and show the variables in real data that have unreasonable values based on domain realities.\n"
            prompt += "SECTION_TITLE: Actionable Recommendations (3–5 recommendations, 250 words minimum)\n"
            prompt += "SECTION_TITLE: Risk Level (LOW, MEDIUM, HIGH) with justification (50 words minimum)\n\n"
            prompt += "IMPORTANT: Start each section with the marker 'SECTION_TITLE: [Title]' on a new line and then provide the content. Do NOT use markdown bold stars (**) for these titles. This is critical for PDF generation.\n"
            prompt += "Dont Hallucinate any data, only base your analysis on the validation results and the data itself. "
            prompt += "Always justify your findings and recommendations using the data itself. "
            prompt += "Make sure to include p-values and reference the statistical tests used.\n"
            return prompt
        except Exception as e:
            logger.error(f"Failed to build prompt: {str(e)}")
            return "Please analyze the provided validation results and provide a comprehensive assessment."

    def _ensure_summary_score_paragraph(self, result_summary, scores):
        text = result_summary if isinstance(result_summary, str) else ""
        if not text:
            text = "SECTION_TITLE: Summary\n"

        paragraph = self._build_summary_score_paragraph(scores)
        marker = "SECTION_TITLE: Summary"

        if "AI Generated Score:" in text:
            return text

        if marker in text:
            return text.replace(marker, f"{marker}\n{paragraph}", 1)

        return f"{marker}\n{paragraph}\n\n{text}"

    def _build_summary_score_paragraph(self, scores):
        def _score_value(key):
            value = scores.get(key) if isinstance(scores, dict) else None
            if isinstance(value, (int, float)):
                return f"{float(value):.1f}"
            return "N/A"

        return (
            "AI Generated Score: "
            f"Overall Similarity Score = {_score_value('overallScore')}, "
            f"Multi-variable Score = {_score_value('multiVariableScore')}, "
            f"Anomaly Burden Score = {_score_value('anomalyScore')}, "
            f"Bivariate Score = {_score_value('bivariateScore')}, "
            f"Structural Validity Score = {_score_value('structuralScore')}, "
            f"Univariate Similarity Score = {_score_value('univariateScore')}."
        )

    def _build_similarity_score_prompt(self, computed_scores, context=None):
        payload = {
            "computed_scores": computed_scores or {},
            "context": context or {},
        }
        prompt = "Given these dataset similarity metrics, provide AI-estimated counterparts.\n"
        prompt += "Keep values on a 0-100 scale and consistent with the evidence.\n\n"
        prompt += json.dumps(payload, indent=2)
        prompt += "\n\nOutput ONLY JSON with this exact schema:\n"
        prompt += "{\n"
        prompt += '  "overallScore": number,\n'
        prompt += '  "structuralScore": number,\n'
        prompt += '  "univariateScore": number,\n'
        prompt += '  "bivariateScore": number,\n'
        prompt += '  "anomalyScore": number,\n'
        prompt += '  "multiVariableScore": number,\n'
        prompt += '  "confidence": "LOW|MEDIUM|HIGH",\n'
        prompt += '  "rationale": "short explanation"\n'
        prompt += "}\n"
        return prompt

    def _extract_json_object(self, text: str):
        if not isinstance(text, str) or not text.strip():
            return {}

        stripped = text.strip()
        try:
            return json.loads(stripped)
        except Exception:
            pass

        start = stripped.find("{")
        end = stripped.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = stripped[start:end + 1]
            try:
                return json.loads(candidate)
            except Exception:
                return {}
        return {}
    
    def is_service_available(self):
        """Check if the AI service is available."""
        try:
            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=10,
                messages=[{"role": "user", "content": "Test"}]
            )
            return True
        except Exception as e:
            logger.warning(f"AI service availability check failed: {str(e)}")
            return False

# Global instance
data_quality_expert = None

def initialize_ai_agent(api_key: str):
    """Initialize the AI data quality expert."""
    global data_quality_expert
    if api_key:
        try:
            data_quality_expert = DataQualityExpert(api_key, settings.claude_model)
            logger.info(
                "AI data quality expert initialized successfully using model %s",
                settings.claude_model,
            )
            return data_quality_expert
        except Exception as e:
            logger.error(f"Failed to initialize AI agent: {str(e)}")
            return None
    else:
        logger.warning("ANTHROPIC_API_KEY not found in .env file")
        return None

def get_ai_agent():
    """Get the AI data quality expert instance."""
    return data_quality_expert

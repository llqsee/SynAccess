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

            return {
                "timestamp": datetime.now().isoformat(),
                "result_summary": response.content[0].text,
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

    def _build_prompt(self, validation_results):
        try:
            prompt = "You are a senior Data Quality Expert.\n\n"
            prompt += "The following are validation results comparing real and synthetic data:\n\n"
            prompt += json.dumps(validation_results, indent=2)
            prompt += "\n\nPlease provide a clear analysis that includes:\n"
            prompt += "- Executive Summary (250 words minimum)\n"
            prompt += "- Key Findings (250 words minimum)\n"
            prompt += "- Statistical Quality(250 words minimum)\n"
            prompt += "- Practical Usefulness(250 words minimum)\n"
            prompt += "- Critical Issues (if any)\n"
            prompt += "- 3–5 Actionable Recommendations(250 words minimum)\n"
            prompt += "- Risk Level (LOW, MEDIUM, HIGH) with justification(the justification should be 50 words minimum)\n"
            prompt += "Dont Hallucinate any data, only base your analysis on the validation results and the data itself"
            prompt += "Always justify your findings and recommendations using the data itself"
            prompt += "make sure to include the p-value and reference to the statistical test used if it uses p-values"
            return prompt
        except Exception as e:
            logger.error(f"Failed to build prompt: {str(e)}")
            return "Please analyze the provided validation results and provide a comprehensive assessment."
    
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

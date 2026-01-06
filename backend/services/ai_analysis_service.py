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
            prompt += "SECTION_TITLE: Summary (250 words minimum)\n"
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

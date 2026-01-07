/**
 * Plan Recommendation Service
 * Provides AI-powered plan recommendations
 * Note: This service can be extended to use any AI provider
 */

export const getPlanRecommendation = async (userPrompt: string): Promise<string> => {
  try {
    // TODO: Implement plan recommendation logic
    // This can be replaced with any AI service or rule-based system
    // For now, return a helpful message based on the prompt
    
    const promptLower = userPrompt.toLowerCase();
    
    // Simple rule-based recommendations
    if (promptLower.includes('free') || promptLower.includes('basic') || promptLower.includes('start')) {
      return "Based on your needs, I recommend starting with our Free plan. It's perfect for exploring AI capabilities with 50,000 monthly tokens and standard generation speed. You can always upgrade later as your needs grow.";
    }
    
    if (promptLower.includes('professional') || promptLower.includes('business') || promptLower.includes('team')) {
      return "For professional use, I recommend our Pro plan at $29/month. It offers 5,000,000 monthly tokens, turbo generation speed, access to advanced models, and priority support - ideal for teams and businesses.";
    }
    
    if (promptLower.includes('enterprise') || promptLower.includes('unlimited') || promptLower.includes('heavy')) {
      return "For enterprise-level needs, our Ultimate plan at $99/month provides unlimited tokens, dedicated compute nodes, ultra-low latency, and 24/7 concierge support. Perfect for heavy usage and mission-critical applications.";
    }
    
    // Default recommendation
    return "I'd be happy to help you choose the right plan! Our Free plan is great for getting started. If you need more power, our Pro plan ($29/month) offers 5M tokens and advanced features. For unlimited usage, consider our Ultimate plan ($99/month). What specific use case are you planning for?";
  } catch (error) {
    console.error("Plan recommendation failed:", error);
    return "Our system is currently busy. Please check our plans page for more details!";
  }
};


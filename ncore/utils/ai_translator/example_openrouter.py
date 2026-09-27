import streamlit as st
import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API key from environment variable
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
REFERRER = "https://walterpinem.com/"  # Replace with your actual site URL
APP_NAME = "Simple AI Translator"

# Free AI models
AI_MODELS = [
    "google/gemini-2.5-pro-exp-03-25:free",
    "google/gemma-3-1b-it:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-27b-it:free",
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "google/gemini-2.0-pro-exp-02-05:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "google/gemini-2.0-flash-thinking-exp-1219:free",
    "google/gemini-2.0-flash-exp:free",
    "google/learnlm-1.5-pro-experimental:free",
    "google/gemini-flash-1.5-8b-exp",
    "google/gemma-2-9b-it:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "deepseek/deepseek-r1-zero:free",
    "deepseek/deepseek-r1-distill-llama-70b:free",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-chat:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "meta-llama/llama-3.2-1b-instruct:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "meta-llama/llama-3-8b-instruct:free",
    "qwen/qwen2.5-vl-3b-instruct:free",
    "qwen/qwen2.5-vl-32b-instruct:free",
    "qwen/qwq-32b:free",
    "qwen/qwen2.5-vl-72b-instruct:free",
    "deepseek/deepseek-r1-distill-qwen-32b:free",
    "deepseek/deepseek-r1-distill-qwen-14b:free",
    "qwen/qwq-32b-preview:free",
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "qwen/qwen-2.5-vl-7b-instruct:free",
    "qwen/qwen-2-7b-instruct:free",
    "allenai/molmo-7b-d:free",
    "bytedance-research/ui-tars-72b:free",
    "featherless/qwerky-72b:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "open-r1/olympiccoder-7b:free",
    "open-r1/olympiccoder-32b:free",
    "rekaai/reka-flash-3:free",
    "moonshotai/moonlight-16b-a3b-instruct:free",
    "nousresearch/deephermes-3-llama-3-8b-preview:free",
    "cognitivecomputations/dolphin3.0-r1-mistral-24b:free",
    "cognitivecomputations/dolphin3.0-mistral-24b:free",
    "mistralai/mistral-small-24b-instruct-2501:free",
    "sophosympatheia/rogue-rose-103b-v0.2:free",
    "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "mistralai/mistral-nemo:free",
    "mistralai/mistral-7b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free",
    "openchat/openchat-7b:free",
    "undi95/toppy-m-7b:free",
    "huggingfaceh4/zephyr-7b-beta:free",
    "gryphe/mythomax-l2-13b:free"
]

# Function to translate text
def translate_text(text, source_lang, target_lang, model):
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": REFERRER,
            "X-Title": APP_NAME,
        },
        data=json.dumps({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": f"You are a translator. Translate the given text from {source_lang} to {target_lang}. Only provide the translation, no additional explanations."
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        })
    )

    if response.status_code == 200:
        return response.json()['choices'][0]['message']['content']
    else:
        return f"Error: {response.status_code}, {response.text}"

# Streamlit UI
st.title("AI Translator")

# Input text area
input_text = st.text_area("Enter text to translate:", height=150)

# Language selection
col1, col2 = st.columns(2)
with col1:
    # Add more languages as needed
    source_lang = st.selectbox("Source Language", ["English", "Spanish", "French", "German", "Chinese", "Japanese"])
with col2:
    # Add more languages as needed
    target_lang = st.selectbox("Target Language", ["Spanish", "English", "French", "German", "Chinese", "Japanese"])

# Model selection
selected_model = st.selectbox("Select AI Model", AI_MODELS)

# Translate button
if st.button("Translate"):
    if input_text and source_lang != target_lang:
        with st.spinner("Translating..."):
            translated_text = translate_text(input_text, source_lang, target_lang, selected_model)
        st.subheader("Translated Text:")
        st.write(translated_text)
    elif source_lang == target_lang:
        st.warning("Please select different languages for source and target.")
    else:
        st.warning("Please enter some text to translate.")

# Add a note about the API usage
st.sidebar.markdown("This translator uses the OpenRouter API to access various AI models for translation.")
st.sidebar.markdown("Different models may have different capabilities and performance characteristics.")
st.sidebar.markdown("For more info, you can read [**this tutorial**](https://walterpinem.com/ai-translator-app-openrouter-api/).")

class OpenAIStore {
    constructor() {
        this.config =  {
            modelType: process.env.AI_ASSISTANT_OPENAI_MODEL_TYPE || "text",
            textModel: process.env.AI_ASSISTANT_OPENAI_TEXT_MODEL || "gpt-3.5-turbo",
            systemMessage: process.env.AI_ASSISTANT_OPENAI_SYSTEM_MESSAGE || "You are a software developer assistant",
            imageModel: "dall-e-2",
            imageSize: "256x256",
            imageStyle: "vivid",
            imageQuality: "standard",
        }
    }

    get(key) {
        return this.config[key];
    }

    set(key, value) {
        this.config[key] = value;

        return this;
    }
}

export default OpenAIStore;

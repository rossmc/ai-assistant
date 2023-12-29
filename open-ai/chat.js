import OpenAI from "openai";;

class OpenAIChat {
    imageHistory = [];
    
    constructor(config) {
        this.config = config;
        this.messages = [
            { role: "system", content: config.systemMessage },
        ];
        this.openai = new OpenAI({ apiKey: process.env.AI_ASSISTANT_OPENAI_API_KEY });
    }

    async sendTextChat(message) {
        this.messages.push({
            role: "user",
            content: message,
        });

        try {
            const response = await this.openai.chat.completions.create({
                messages: this.messages,
                model: this.config.textModel,
            });

            const responseMsg = response.choices[0].message.content;

            if (responseMsg) {
                this.messages.push({
                    role: "assistant",
                    content: responseMsg,
                });
            }

            return responseMsg;
        } catch (error) {
            const message = `Error sending message: ${error.message}`;
            console.error(message);
            return {error: message};
        }
    }

    async createImage(prompt) {
        let chat = {prompt: prompt, response: null};
        try {
            const response = await this.openai.images.generate({
                model: this.config.imageModel,
                prompt: prompt,
                n: 1,
                size: this.config.imageSize,
                style: this.config.imageStyle,
                quality: this.config.imageQuality,
            });
            chat.response = response.data[0];
            return response.data[0];
        } catch (error) {
            const message = `Error creating image: ${error.message}`;
            chat.response = message;
            console.error(message);
            return {error: message};
        } finally {
            this.imageHistory.push(chat);
        }
    }

    getChatHistory() {
        if (this.config.imageModel) {
            return this.imageHistory;
        }

        return this.messages;
    }
}

export default OpenAIChat;

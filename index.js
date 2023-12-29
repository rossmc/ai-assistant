#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import "dotenv/config";
import dotenv from 'dotenv';
import {
    intro,
    outro,
    select,
    spinner,
    isCancel,
    cancel,
    text,
} from "@clack/prompts";
import color from "picocolors";
import OpenAIChat from "./open-ai/chat.js";
import OpenAIStore from "./open-ai/store.js";
import minimist from 'minimist';
import terminalLink from 'terminal-link';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

class Assistant {
    textMsg = `${color.bold("Ask")} a question or hit enter to quit:`;
    imageMsg = `Enter a ${color.bold("prompt")} to generate an image or hit enter to quit`;

    constructor() {
        this.currentModuleDir = path.dirname(new URL(import.meta.url).pathname);
        const envPath = path.resolve(this.currentModuleDir, '.env');
        dotenv.config({ path: envPath });

        this.oaiStore = new OpenAIStore();
        this.s = spinner();
        this.args = minimist(process.argv.slice(2));
        marked.use(markedTerminal());
    }

    async run() {
        intro(color.inverse(" Your Terminal AI Assistant 🤖 "));
        if (this.args.help || this.args.h) {
            this.exit();
        }

        if (this.args.image || this.args.i) {
            this.oaiStore.set('modelType', 'image');
        }

        if (this.args.config || this.args.c) {
            await this.configureAssistant();
        }

        if (this.oaiStore.get('modelType') === 'image') { // we always ask user to configure image assistant when image is selected
            await this.configureImageAssistant();
        }

        this.oaiChat = new OpenAIChat(this.oaiStore.config);

        this.question();
    }

    async configureAssistant() {
        intro(`${color.bold("Configure")} your assistant for next session:\n${color.dim("   Persistent settings are added to your .env file.")}\n`);

        this.oaiStore.set(
            'modelType',
            await select({
                message: 'Pick a generation model type.',
                options: [
                    { value: 'text', label: 'Text' },
                    { value: 'image', label: 'Image' }
                ],
            })
        );

        if (this.oaiStore.get('modelType') === 'text') {
            await this.configureTextAssistant();
        }
    }

    async configureTextAssistant() {
        this.oaiStore.set(
            'textModel',
            await select({
                message: 'Pick a text model.',
                options: [
                    { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
                    { value: 'gpt-4', label: 'gpt-4' },
                    { value: 'gpt-4-1106-preview', label: 'gpt-4 turbo' },
                ],
            })
        );

        this.oaiStore.set(
            'systemMessage',
            await text({
                message: "Add your system message to sey the context and guide the behavior of the language model during the conversation",
                placeholder: this.oaiStore.get('systemMessage')
            })
        );
    }

    async configureImageAssistant() {
        const sizeModel = await select({
            message: 'Choose your image size and generation model.',
            options: [
                { value: '256x256_dall-e-2', label: '256×256px with dall-e-2' },
                { value: '512x512_dall-e-2', label: '512×512px with dall-e-2' },
                { value: '1024x1024_dall-e-2', label: '1024×1024px with dall-e-2' },
                { value: '1024x1024_dall-e-3', label: '1024×1024px with dall-e-3' },
                { value: '1792x1024_dall-e-3', label: '1792×1024px with dall-e-3' },
                { value: '1024x1792_dall-e-3', label: '1024×1792px with dall-e-3' },
            ],
        });

        this.oaiStore
            .set('imageSize',  sizeModel.split('_')[0])
            .set('imageModel',  sizeModel.split('_')[1]);

        if (this.oaiStore.get('imageModel') === 'dall-e-3') {
            this.oaiStore.set(
                'imageStyle',
                await select({
                    message: 'Select an image style (only available for dall-e-3)',
                    options: [
                        { value: 'vivid', label: 'Vivid: hyper-real and dramatic images' },
                        { value: 'natural', label: 'Natural: more natural, less hyper-real looking images' }
                    ],
                }
            ))
            .set(
                'imageQuality',
                await select({
                    message: 'Select the image quality (only available for dall-e-3)',
                    options: [
                        { value: 'standard', label: 'Standard: hyper-real and dramatic images' },
                        { value: 'hd', label: 'HD: more natural, less hyper-real looking images' }
                    ],
                })
            );  
        }
    }

    async question() {
        let question = false;

        do {
            question = await this.ask();
            switch (this.oaiStore.get('modelType')) {
                case 'image':
                    await this.processImageQuestion(question);
                    break;
                default:
                    await this.processTextQuestion(question);
                    break;
            }
        } while (question);
    }

    async ask() {
        let prompt = await text({
            message: this.oaiStore.get('modelType') === 'image' ? this.imageMsg : this.textMsg,
        });

        if (isCancel(prompt) || !prompt) {
            this.exit();
        }

        return prompt;
    }

    async processTextQuestion(prompt) {
        this.s.start("fetching answer");
        let answer = await this.oaiChat.sendTextChat(prompt);
        this.s.stop();

        if (answer.error) {
            outro(answer.error);
            return this.exit();
        }

        intro(`${color.bold("Answer:")}\n${marked(answer)}`);
    }

    async processImageQuestion(prompt) {
        this.s.start("fetching image");
        const response = await this.oaiChat.createImage(prompt);
        this.s.stop();

        if (response.error) {
            outro(response.error);
            return this.exit();
        }

        let imgResponse = terminalLink(`${color.blue('Click here to view the generated image in your browser')}`, response.url)
        imgResponse += `\n${color.dim('   command + click on a mac')}`;

        if (response.revised_prompt) {
            imgResponse += `\nRevised Prompt: ${response.revised_prompt}`;
        }

        intro(`${color.bold("Response:")}\n${imgResponse}`);
    }

    goodbyeMessage(saveChatedChat = false) {
        let msg = `Thanks for using ${color.bold("Your Terminal AI Assistant!")}\n`;
        
        if (saveChatedChat) {
            msg += `\n${saveChatedChat}\n`;
        }
        msg += `\nAvailable flags:`;
        msg += `\n${color.bold("--help or -h")}          show this help message`;
        msg += `\n${color.bold("--config or -c")}        configure assistant for next session`;
        msg += `\n${color.bold("--image or -i")}         create an image`;
        msg += `\n`;
        msg += `\n${color.inverse(" Good Bye ")} 👋🏻`;
        
        return msg;
    }

    exit() {
        cancel();
        outro(this.goodbyeMessage(this.saveChat()));
        process.exit(0);
    }

    saveChat() {   
        const modelType = this.oaiStore.get('modelType'); 
        const imageHistory = this.oaiChat.imageHistory;
        const textHistory = this.oaiChat.messages;
        let responseMessage = '';

        if (!imageHistory.length && textHistory.length <= 1) {
            return;
        }

        const obj = {
            config: this.oaiStore.config,
            history: modelType === 'image' ? imageHistory : textHistory,
        }

        const historyDir = path.resolve(this.currentModuleDir, `history`);
        const directoryPath = path.resolve(historyDir, modelType);

        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir);
        }

        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath);
        }

        const timestamp = new Date().toLocaleString().replace(/[ ,:/]/g, '-');
        const filePath = `${directoryPath}/${timestamp}.json`;
        const jsonString = JSON.stringify(obj, null, 2);

        try {
            fs.writeFileSync(filePath, jsonString);
            responseMessage = `History saved to file: ${filePath}`;
        } catch (error) {
            responseMessage = `Error saving history to file: ${error.message}`
        }

        return responseMessage;
    }
}

const assistant = new Assistant();
assistant.run().catch(console.error);

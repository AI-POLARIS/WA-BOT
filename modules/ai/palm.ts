import { GoogleAuth } from "google-auth-library";
import { v1beta2 as palm } from "@google-ai/generativelanguage";
import Console from "../../utils/console";

const GCP_API_KEY = process.env.GCP_API_KEY || "";

/**
 * @description Create a new instance of the Google Auth Client
 * 
 * @returns {GoogleAuth}
 */
export const AuthClient = new GoogleAuth().fromAPIKey(GCP_API_KEY);

/**
 * @description Create a new instance of the Model Service Client
 * 
 * @returns {palm.ModelServiceClient}
 */
export const ModelServiceClient = new palm.ModelServiceClient({
    authClient: AuthClient
});

/**
 * @description List of available models
 * from url: https://generativelanguage.googleapis.com/v1beta2/models?key=$PALM_API_KEY
 */
export async function listModels() {
    const models = [];

    try {
        // Construct request
        const request = {
        };

        // Run request
        const iterable = ModelServiceClient.listModelsAsync(request);

        for await (const response of iterable) {
            models.push(response);
        }
    } catch (error) {
        Console.error(error);
    }

    return models;
}

export const discussClient = new palm.DiscussServiceClient({
    authClient: AuthClient,
});

export const textClient = new palm.TextServiceClient({
    authClient: AuthClient,
});

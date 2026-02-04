import axios from "axios";

/**
 * Generic retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    apiName: string;
    maxRetries?: number;
    initialDelay?: number;
    logSuccess?: boolean;
    logRetry?: boolean;
  }
): Promise<T> {
  const {
    apiName,
    maxRetries = 3,
    initialDelay = 1000,
    logSuccess = false,
    logRetry = true,
  } = options;

  let retryCount = 0;
  let delay = initialDelay;

  while (true) {
    try {
      if (retryCount > 0 && logRetry) {
        console.log(`[${apiName}] Attempt ${retryCount}/${maxRetries}...`);
      }

      const result = await fn();

      if (logSuccess && retryCount > 0) {
        console.log(`[${apiName}] Success after ${retryCount} retries`);
      }

      return result;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;

      // Retry on rate limit (429) or server errors (5xx)
      if (status === 429 || (status && status >= 500 && status < 600)) {
        retryCount++;

        if (retryCount <= maxRetries) {
          if (logRetry) {
            console.log(
              `[${apiName}] Error ${status}. Retrying after ${delay}ms... (${retryCount}/${maxRetries})`
            );
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
      }

      throw error;
    }
  }
}

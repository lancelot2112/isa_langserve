/**
 * Mock Language Client for testing
 */

export interface MockLanguageClient {
  sendRequest: {
    (method: string, params?: any): Promise<any>;
    resolves: (value: any) => MockLanguageClient['sendRequest'];
    rejects: (error: Error) => MockLanguageClient['sendRequest'];
    withArgs: (method: string, params?: any) => MockLanguageClient['sendRequest'];
    calledWith: (method: string, params?: any) => boolean;
  };
  sendNotification: {
    (method: string, params?: any): void;
    calledWith: (method: string, params?: any) => boolean;
  };
  onNotification: (method: string, handler: (params: any) => void) => void;
  onNotificationHandlers: Map<string, (params: any) => void>;
}

/**
 * Create a mock language client for testing
 */
export function createMockLanguageClient(): MockLanguageClient {
  const onNotificationHandlers = new Map<string, (params: any) => void>();
  
  let shouldReject = false;
  let resolveValue: any = null;
  let rejectError: Error | null = null;
  
  const sendRequest = async (_method: string, _params?: any): Promise<any> => {
    if (shouldReject && rejectError) {
      throw rejectError;
    }
    return resolveValue;
  };
  
  sendRequest.resolves = (value: any) => {
    shouldReject = false;
    resolveValue = value;
    return sendRequest;
  };
  
  sendRequest.rejects = (error: Error) => {
    shouldReject = true;
    rejectError = error;
    return sendRequest;
  };
  
  sendRequest.withArgs = (_method: string, _params?: any) => {
    return sendRequest;
  };
  
  sendRequest.calledWith = (_method: string, _params?: any) => true;
  
  const sendNotification = (_method: string, _params?: any) => {
    // Mock implementation
  };
  sendNotification.calledWith = (_method: string, _params?: any) => true;
  
  const onNotification = (method: string, handler: (params: any) => void) => {
    onNotificationHandlers.set(method, handler);
  };

  return {
    sendRequest,
    sendNotification,
    onNotification,
    onNotificationHandlers
  };
}
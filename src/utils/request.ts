import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse, Method } from 'axios';

type RequestConfig = AxiosRequestConfig & { type?: Method };
type QueueItem = {
  config: AxiosRequestConfig;
  resolve: (_response: AxiosResponse<any>) => void;
  reject: (_error: unknown) => void;
};

const requestQueue: QueueItem[] = [];
let concurrentCount = 0;
const MAX_CONCURRENT = 10;

function processQueue() {
  if (concurrentCount >= MAX_CONCURRENT || requestQueue.length === 0) return;
  const { config, resolve, reject } = requestQueue.shift();
  concurrentCount += 1;
  axios(config)
    .then((res) => {
      concurrentCount -= 1;
      resolve(res);
      processQueue();
    })
    .catch((err) => {
      concurrentCount -= 1;
      reject(err);
      processQueue();
    });
}

function request<T = any>(config: RequestConfig): Promise<AxiosResponse<T>> {
  const axiosConfig = { ...config };
  if (!axiosConfig.method && axiosConfig.type) {
    axiosConfig.method = axiosConfig.type;
  }
  delete axiosConfig.type;
  return new Promise<AxiosResponse<T>>((resolve, reject) => {
    requestQueue.push({ config: axiosConfig, resolve, reject });
    processQueue();
  });
}

export default request;

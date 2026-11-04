import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

declare global {
  interface Window {
    $$aoboboConfig?: Record<string, any>;
    $$nazhuaConfig?: Record<string, any>;
    $mergeAoboboConfig?: (config: Record<string, any>) => void;
    $mergeNazhuaConfig?: (config: Record<string, any>) => void;
  }

  interface ImportMetaEnv {
    readonly BASE_URL: string;
    readonly VITE_APP_VERSION: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

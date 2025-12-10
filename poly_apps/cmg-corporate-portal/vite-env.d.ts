declare const process: {
  env: {
    readonly API_KEY: string;
    readonly [key: string]: string | undefined;
  }
};

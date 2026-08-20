module.exports = {
  apps: [
    {
      name: "blih-erp-api",
      script: "./dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        JOB_WORKER_ENABLED: "false"
      },
      env_production: {
        NODE_ENV: "production",
        JOB_WORKER_ENABLED: "false"
      }
    },
    {
      name: "blih-erp-worker",
      script: "./dist/worker.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        JOB_WORKER_ENABLED: "true",
        POLICY_JOBS_ENABLED: "true",
        JOB_TIMEZONE: "Africa/Addis_Ababa"
      },
      env_production: {
        NODE_ENV: "production",
        JOB_WORKER_ENABLED: "true",
        POLICY_JOBS_ENABLED: "true",
        JOB_TIMEZONE: "Africa/Addis_Ababa"
      }
    }
  ]
};

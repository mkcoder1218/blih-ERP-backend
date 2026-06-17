
module.exports = {
  apps: [{
    name: "blih-erp-backend",
    script: "./dist/server.js",
    instances: "max", // leverages all cores in production
    exec_mode: "cluster",
    env: {
      NODE_ENV: "development",
      JOB_WORKER_ENABLED: "true",
      JOB_TIMEZONE: "UTC",
    },
    env_production: {
      NODE_ENV: "production",
      JOB_WORKER_ENABLED: "true",
      JOB_TIMEZONE: "UTC",
    }
  }]
}

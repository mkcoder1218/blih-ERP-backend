
module.exports = {
  apps: [{
    name: "blih-erp-backend",
    script: "./dist/server.js",
    instances: "max", // leverages all cores in production
    exec_mode: "cluster",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}

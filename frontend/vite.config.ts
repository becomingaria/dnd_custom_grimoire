import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 4777,
        open: true,
    },
    build: {
        outDir: "dist",
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom", "react-router-dom"],
                    motion: ["framer-motion"],
                    aws: ["aws-amplify"],
                    query: ["@tanstack/react-query"],
                },
            },
        },
    },
})

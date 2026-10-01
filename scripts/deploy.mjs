import { cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = resolve(projectRoot, 'dist')
const deploymentDirectory = 'Z:/math-fluency'

if (!existsSync(deploymentDirectory)) {
  throw new Error(`Deployment directory is not available: ${deploymentDirectory}`)
}

cpSync(distDirectory, deploymentDirectory, { recursive: true })
console.log(`Copied dist contents to ${deploymentDirectory}`)
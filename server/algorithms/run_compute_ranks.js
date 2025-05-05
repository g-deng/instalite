import { spawn } from 'child_process';

/**
 * Runs the ComputeRanksLocal Java job.
 */
export function runComputeRanks() {
  return new Promise((resolve, reject) => {
    const child = spawn('java', [
      '-cp',
      '/root/nets2120/project-instalite-wahoo/spark-jobs/target/framework.jar',
      'instalite.wahoo.jobs.ComputeRanksLivy'
    ]);    

    let stdout = '';

    child.stdout.on('data', (data) => {
      const text = data.toString().trim();
      console.log(`stdout: ${text}`);
      stdout += text;
    });

    child.stderr.on('data', (data) => {
      reject(data);
    });

    child.on('error', (err) => {
      console.error(`Error spawning process: ${err.message}`);
      reject(err);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const err = new Error(`Process exited with code ${code}`);
        console.error(err.message);
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function postComputeRanks(req, res) {
    try {
        const output = await runComputeRanks();
        res.status(200).json({ message: 'Ranking job completed.', output });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to run ranking job.' });
    }
}

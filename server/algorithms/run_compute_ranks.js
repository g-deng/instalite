import { exec } from 'child_process';

/**
 * Runs the ComputeRanksLocal Java job.
 * @returns {Promise<string>} Resolves with stdout or rejects on error
 */
export function runComputeRanks() {
  return new Promise((resolve, reject) => {
    exec('java -jar /root/nets2120/instalite/spark-jobs/target/framework.jar', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running ComputeRanksLocal: ${error.message}`);
        reject(error);
        return;
      }

      if (stderr) {
        console.warn(`stderr: ${stderr}`);
      }

      console.log(`stdout: ${stdout}`);
      resolve(stdout);
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

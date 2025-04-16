import S3KeyValueStore from '../models/s3.js';
import fs from 'fs';
import path from 'path';

describe('S3 File Upload and Retrieval', () => {
    const bucketName = 'nets2120-chroma-wahoo';
    const keyPrefix = 'uploads/';
    const testFileName = `${Date.now()}_laurenbacall.jpeg`;
    const testFilePath = "/root/nets2120/project-instalite-wahoo/instalite/server/tests/laurenbacall.jpeg";

    let s3Store;

    beforeAll(() => {
        // Initialize S3KeyValueStore with test bucket and profile
        s3Store = new S3KeyValueStore(bucketName, 'user');
    });

    it('should upload and retrieve a file from S3', async () => {
        // Ensure the test file exists
        if (!fs.existsSync(testFilePath)) {
            throw new Error(`Test file not found: ${testFilePath}`);
        }

        // Upload the file to S3
        const res = await s3Store.uploadFile(testFilePath, bucketName, keyPrefix);
        expect(res).toBeDefined();
    });
});
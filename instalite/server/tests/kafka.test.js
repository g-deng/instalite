import { addKafkaPostToDB, registerKafkaUser, closeKafkaConsumer } from '../kafka/consumer.js';
import { get_db_connection } from '../models/rdbms.js';

// Mock the database connection
jest.mock('../server/models/rdbms.js', () => ({
    get_db_connection: () => ({
        send_sql: jest.fn()
    })
}));

const mockSendSql = get_db_connection().send_sql;

describe('Kafka Consumer Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('registerKafkaUser returns existing user_id if found', async () => {
        mockSendSql.mockResolvedValueOnce([[{ user_id: 42 }]]);
        const userId = await registerKafkaUser('testUser');
        expect(userId).toBe(42);
        expect(mockSendSql).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['testUser']);
    });

    test('registerKafkaUser inserts new user if not found', async () => {
        mockSendSql
            .mockResolvedValueOnce([[]]) // No user found
            .mockResolvedValueOnce([{ insertId: 99 }]); // Insert returns new ID

        const userId = await registerKafkaUser('newUser');
        expect(userId).toBe(99);
        expect(mockSendSql).toHaveBeenCalledTimes(2);
    });

    test('addKafkaPostToDB inserts post into database', async () => {
        mockSendSql
            .mockResolvedValueOnce([[{ user_id: 1 }]]) // user exists
            .mockResolvedValueOnce([{ insertId: 123 }]); // post inserted

        const mockPost = {
            username: 'alice',
            source_site: 'Bluesky',
            topic: 'BlueSky',
            content: 'hello from bluesky!'
        };

        await addKafkaPostToDB(mockPost);
        expect(mockSendSql).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO posts'),
            [null, expect.any(String), mockPost.content, 1]
        );
    });

    test('addKafkaPostToDB skips empty posts', async () => {
        const incompletePost = {
            username: 'bob',
            source_site: 'Redsky',
            topic: 'RedSky',
            content: ''
        };

        await addKafkaPostToDB(incompletePost);
        expect(mockSendSql).not.toHaveBeenCalled();
    });
});

afterAll(async () => {
    await closeKafkaConsumer();
}
);

import React, { useState } from 'react';
import axios from 'axios';
import config from '../../config.json';
import SearchForm from '../components/SearchFormComponent';
import ActorCardComponent from '../components/ActorCardComponent';

function Upload() {
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const rootURL = config.serverRootURL;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Please select an image to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('image', selectedFile);
        setIsLoading(true);

        try {
            const response = await axios.post(`${rootURL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            console.log(response);
            const embedding = response.data.embedding;
            console.log('Embedding:', embedding);
            await findMatches(embedding);
        } catch (err: any) {
            setError(err.response ? err.response.data.error : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const findMatches = async (embedding) => {
        try {
            const response = await axios.post(`${rootURL}/match`, { embedding }); // Refactoring root url to config
            console.log(response.data);
            setSearchResults(response.data);
            setError('');
        } catch (err: any) {
            setSearchResults([]);
            setError(err.response ? err.response.data.error : 'An error occurred');
        }
    };

    return (
        <div className="page-container">
            <div className="heading">IMDB Actor Search</div>
            {/* <SearchForm onSearch={handleSearch} /> */}
            <div className="upload-section">
                <input type="file" accept="image/*" onChange={handleFileChange} />
                <button onClick={handleUpload} disabled={isLoading}>
                    {isLoading ? 'Uploading...' : 'Upload Image'}
                </button>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="results">
                {searchResults && searchResults.map((img, idx) => (
                    <ActorCardComponent key={idx} imagePath={img} />
                ))}
            </div>
        </div>
    );
}

export default Upload;
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
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [savedKey, setSavedKey] = useState<string | null>(null);

    const rootURL = config.serverRootURL;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = async (e: React.MouseEvent) => {
        console.log('HIHIHIHIHIIHIHIHIHIHIIHIHIHIHIIHIHIHIHIHIHIHIHIHIHIHIHIHIHIHI');
        e.preventDefault(); // Prevent any default form submission
        if (!selectedFile) {
            setError('Please select an image to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('image', selectedFile);
        setIsLoading(true);
        setUploadSuccess(false);
        setSavedKey(null);

        try {
            const response = await axios.post(`${rootURL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                withCredentials: true,
            });

            console.log('Upload response:', response.data);
            
            // Store the key and embedding
            const embedding = response.data.embedding;
            const key = response.data.key;
            
            if (!key) {
                console.error('No key in response data');
                setError('No image key received from server');
                setIsLoading(false);
                return;
            }
            
            console.log('Embedding:', embedding);
            console.log('S3 Key:', key);
            
            // save image key
            try {
                const saveResponse = await axios.post(
                    `${rootURL}/saveUserSelfie`, 
                    { image_path: key }, 
                    { withCredentials: true }
                );
                console.log('Save response:', saveResponse.data);
                setUploadSuccess(true);
                setSavedKey(key);
            } catch (saveErr: any) {
                console.error('Error saving image:', saveErr);
                console.error('Error details:', saveErr.response ? saveErr.response.data : saveErr.message);
            }
            
            await findMatches(embedding);
        } catch (err: any) {
            console.error('Upload error:', err);
            console.error('Error details:', err.response ? err.response.data : err.message);
            setError(err.response ? err.response.data.error : 'An error occurred during upload');
        } finally {
            setIsLoading(false);
        }
    };

    const findMatches = async (embedding) => {
        try {
            const response = await axios.post(`${rootURL}/match`, { embedding }); 
            console.log('Match response:', response.data);
            setSearchResults(response.data);
            setError('');
        } catch (err: any) {
            console.error('Match error:', err);
            setSearchResults([]);
            setError(err.response ? err.response.data.error : 'An error finding matches');
        }
    };

    return (
        <div className="page-container">
            <div className="heading">IMDB Actor Search</div>
            
            <div className="upload-section">
                <input type="file" accept="image/*" onChange={handleFileChange} />
                <button onClick={handleUpload} disabled={isLoading}>
                    {isLoading ? 'Uploading...' : 'Upload Image'}
                </button>
            </div>
            
            {uploadSuccess && (
                <div className="success-message">
                    Image uploaded and saved successfully! Key: {savedKey}
                </div>
            )}
            
            {error && <div className="error">{error}</div>}
            

        </div>
    );
}

export default Upload;
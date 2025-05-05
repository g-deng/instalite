import React, { useState } from 'react';
import axios from 'axios';
import config from '../../config.json';
import ActorCardComponent from '../components/ActorCardComponent';
import { Navigate, useParams, useNavigate } from 'react-router-dom';

const PhotoSelection = () => {
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const username = useParams();
    const navigate = useNavigate();

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

    const handleSelectPhoto = async (img_path: string) => {
        try {
            const response = await axios.post(`${rootURL}/${username}/selectPhoto`, { image_path: img_path }, { withCredentials: true });
            if (response.status === 200) {
                console.log('Photo selected successfully:', response.data);
                navigate(`/${username}/home`);
            } else {
                console.error('Error selecting photo:', response.data);
            }
        } catch (err: any) {
            setError(err.response ? err.response.data.error : 'An error occurred');
        }
    };

    return (
        <div
            style={{
                maxWidth: '800px',
                margin: '0 auto',
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                fontFamily: 'sans-serif',
            }}
        >
            <h1
                style={{
                    fontSize: '28px',
                    textAlign: 'center',
                    marginBottom: '24px',
                    color: '#333',
                }}
            >
                Photo Selection
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{
                        padding: '8px',
                        fontSize: '14px',
                    }}
                />
                <button
                    onClick={handleUpload}
                    disabled={isLoading}
                    style={{
                        padding: '10px 16px',
                        fontSize: '16px',
                        backgroundColor: isLoading ? '#aaa' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                    }}
                >
                    {isLoading ? 'Uploading...' : 'Upload Photo'}
                </button>
                {error && (
                    <p style={{ color: '#d9534f', fontSize: '14px' }}>
                        {error}
                    </p>
                )}
            </div>

            {searchResults.length > 0 && (
                <div>
                    <h2
                        style={{
                            fontSize: '22px',
                            marginBottom: '16px',
                            color: '#444',
                        }}
                    >
                        Select Your Profile Photo
                    </h2>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '16px',
                        }}
                    >
                        {searchResults.map((img, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                                <ActorCardComponent imagePath={img} />
                                <button
                                    onClick={() => handleSelectPhoto(img)}
                                    style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Select Photo
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

};

export default PhotoSelection;
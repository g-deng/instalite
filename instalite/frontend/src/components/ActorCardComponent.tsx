import React from 'react';

const ActorCardComponent = ({ imagePath }) => {
    const finalPath = "https://nets2120-images.s3.amazonaws.com/" + imagePath.path;
    return (
        <div className="actor-card">
            {imagePath.path && <img src={finalPath} alt={imagePath.path} className="actor-image" />}
        </div>
    );
};

export default ActorCardComponent;
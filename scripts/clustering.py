"""K-means, silhouette score and PCA, written with NumPy only.

These are implemented by hand (no scikit-learn) as the project's
advanced-modeling component.
"""

import numpy as np


def standardize(X):
    """Scale each column to mean 0 and standard deviation 1.

    Features like speed (km/h) and braking distance (m) have different units;
    without scaling, the largest-valued feature would dominate the distances.
    """
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1.0
    return (X - mean) / std, mean, std


def _kmeans_plus_plus_init(X, k, rng):
    """Pick starting centers far apart from each other (k-means++)."""
    centers = [X[rng.integers(len(X))]]
    for _ in range(1, k):
        # squared distance from every point to its nearest chosen center
        d2 = np.min(((X[:, None, :] - np.array(centers)[None, :, :]) ** 2).sum(axis=2), axis=1)
        centers.append(X[rng.choice(len(X), p=d2 / d2.sum())])
    return np.array(centers)


def kmeans(X, k, n_init=20, max_iter=300, tol=1e-6, seed=0):
    """Cluster the rows of X into k groups.

    Runs Lloyd's algorithm n_init times from different k-means++ starts and
    keeps the run with the lowest inertia (sum of squared distances from each
    point to its cluster center).

    Returns (labels, centers, inertia).
    """
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(n_init):
        centers = _kmeans_plus_plus_init(X, k, rng)
        for _ in range(max_iter):
            # assignment step: each point joins its nearest center
            dist = ((X[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
            labels = dist.argmin(axis=1)
            # update step: each center moves to the mean of its points
            new_centers = np.array([
                X[labels == j].mean(axis=0) if np.any(labels == j) else centers[j]
                for j in range(k)
            ])
            shift = np.abs(new_centers - centers).max()
            centers = new_centers
            if shift < tol:
                break
        inertia = ((X - centers[labels]) ** 2).sum()
        if best is None or inertia < best[2]:
            best = (labels, centers, inertia)
    return best


def silhouette_score(X, labels):
    """Mean silhouette: how much closer each point is to its own cluster than
    to the next-closest cluster. Ranges from -1 (bad) to 1 (well separated)."""
    dist = np.sqrt(((X[:, None, :] - X[None, :, :]) ** 2).sum(axis=2))
    clusters = np.unique(labels)
    scores = np.zeros(len(X))
    for i in range(len(X)):
        own = labels == labels[i]
        if own.sum() <= 1:
            continue  # silhouette of a single-point cluster is defined as 0
        a = dist[i, own].sum() / (own.sum() - 1)  # exclude the point itself
        b = min(dist[i, labels == c].mean() for c in clusters if c != labels[i])
        scores[i] = (b - a) / max(a, b)
    return scores.mean()


def pca_2d(X):
    """Project standardized rows of X onto their first two principal components.

    Returns (coords, explained_variance_ratio, components).
    """
    centered = X - X.mean(axis=0)
    # SVD: the rows of Vt are the principal directions, sorted by variance
    _, s, Vt = np.linalg.svd(centered, full_matrices=False)
    explained = (s ** 2) / (s ** 2).sum()
    return centered @ Vt[:2].T, explained[:2], Vt[:2]

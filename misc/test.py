import numpy as np

n = 5

matrix = np.zeros((n, n), dtype=int)

matrix[::2, 1::2] = 1
matrix[1::2, ::2] = 1

for i in range(n):
    for j in range(n):
        print(matrix[i][j], end=" ")
    print()

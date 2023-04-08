#include <iostream>
#include <vector>
#include <complex>
#include <cmath>
#include <chrono>

const double PI = std::acos(-1);

void fft(std::vector<std::complex<double>>& v, bool inverse) {
    int n = v.size();
    if (n == 1) {
        return;
    }
    std::vector<std::complex<double>> even(n / 2), odd(n / 2);
    for (int i = 0; i < n / 2; i++) {
        even[i] = v[2 * i];
        odd[i] = v[2 * i + 1];
    }
    fft(even, inverse);
    fft(odd, inverse);
    double theta = 2 * PI / n * (inverse ? -1 : 1);
    std::complex<double> w(1), wn(std::cos(theta), std::sin(theta));
    for (int i = 0; i < n / 2; i++) {
        v[i] = even[i] + w * odd[i];
        v[i + n / 2] = even[i] - w * odd[i];
        if (inverse) {
            v[i] /= 2;
            v[i + n / 2] /= 2;
        }
        w *= wn;
    }
}

std::vector<double> convolve(const std::vector<double>& A, const std::vector<double>& B) {
    int n = A.size() + B.size() - 1;
    int m = 1;
    while (m < n) {
        m <<= 1;
    }
    std::vector<std::complex<double>> fA(m), fB(m), fC(m);
    for (int i = 0; i < A.size(); i++) {
        fA[i] = A[i];
    }
    for (int i = 0; i < B.size(); i++) {
        fB[i] = B[i];
    }
    fft(fA, false);
    fft(fB, false);
    for (int i = 0; i < m; i++) {
        fC[i] = fA[i] * fB[i];
    }
    fft(fC, true);
    std::vector<double> C(n);
    for (int i = 0; i < n; i++) {
        C[i] = fC[i].real();
    }
    return C;
}

int main() {
    const int N = 1000;
    std::vector<double> A(N), B(N);
    auto total = 0;
    const int ITER = 1000;
    for (int i = 0; i < ITER; i++) {
        auto start = std::chrono::high_resolution_clock::now();
        for (int i = 0; i < N; i++) {
            A[i] = std::sin(2 * PI * i / N);
            B[i] = std::cos(2 * PI * i / N);
        }
        std::vector<double> C = convolve(A, B);
        auto stop = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(stop - start);
        auto r = duration.count();
        // std::cout << "Duration: " << r << "ms" << '\n';
        total += r;
        // std::cout << "Convolution of two sequences of length " << N << ": " << C[N / 2] << '\n';
    }
    std::cout << "Total duration: " << total << "ms" << '\n';
    return 0;
}
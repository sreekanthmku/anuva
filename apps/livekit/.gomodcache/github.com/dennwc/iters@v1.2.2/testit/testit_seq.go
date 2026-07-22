//go:build go1.23

package testit

import (
	"iter"
	"slices"
	"testing"
)

func ExpectSeq[T any](t testing.TB, exp []T, it iter.Seq[T]) {
	got := slices.Collect(it)
	checkRes(t, exp, got, nil, nil)
}

func ExpectSeqErr[T any](t testing.TB, exp []T, expErr error, it iter.Seq2[T, error]) {
	var (
		got    []T
		gotErr error
	)
	for v, err := range it {
		if err != nil {
			gotErr = err
			break
		}
		got = append(got, v)
	}
	checkRes(t, exp, got, expErr, gotErr)
}

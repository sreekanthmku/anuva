//go:build go1.23

package iters_test

import (
	"slices"
	"testing"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestSeqIter(t *testing.T) {
	testit.ExpectIter(t,
		[]int(nil), nil,
		Seq(slices.Values([]int(nil))),
	)
	testit.ExpectIter(t,
		[]int{1, 2, 3}, nil,
		Seq(slices.Values([]int{1, 2, 3})),
	)
	testit.ExpectSeq(t,
		[]int(nil),
		AsSeq(Slice([]int(nil))),
	)
	testit.ExpectSeq(t,
		[]int{1, 2, 3},
		AsSeq(Slice([]int{1, 2, 3})),
	)
}

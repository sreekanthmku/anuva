package iters_test

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/shoenig/test/must"

	. "github.com/dennwc/iters"
	"github.com/dennwc/iters/testit"
)

func TestEncode(t *testing.T) {
	var buf bytes.Buffer
	err := Encode[int](json.NewEncoder(&buf), Slice([]int{1, 2, 3}))
	must.NoError(t, err)
	it := Decode[int](json.NewDecoder(&buf))
	testit.ExpectIter(t, []int{1, 2, 3}, nil, it)
}

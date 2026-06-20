<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'question_bank_id' => $this->question_bank_id,
            'question_text' => $this->question_text,
            'question_type' => $this->question_type->value,
            'marks'         => $this->marks,
            'order_index'   => $this->order_index,
            'options'       => $this->whenLoaded('options', fn () => $this->options
                ->sortBy('option_label')
                ->values()
                ->map(fn ($o) => [
                    'id'           => $o->id,
                    'option_label' => $o->option_label,
                    'option_text'  => $o->option_text,
                    'is_correct'   => (bool) $o->is_correct,
                ])),
            'answers'       => $this->whenLoaded('answers', fn () => $this->answers
                ->pluck('correct_answer')
                ->values()),
        ];
    }
}
